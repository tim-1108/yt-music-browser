import type { ServerWebSocket } from "bun";
import { checkForAutoPackaging, pushQueueIntoDownloaders } from "../..";
import { createClientboundPacket } from "../../packets";
import { clients, jobs } from "../../storage";

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { filterStrings } from "../../types";
import type {
	ClientSocketData,
	DownloaderSocketData,
	DownloadJob,
	JobDownloadFailS2CPacket,
	JobDownloadFinishS2CPacket
} from "../../../common/types";

export default async (ws: ServerWebSocket<DownloaderSocketData>, data: Buffer) => {
	const jobId = ws.data.current_download;
	if (jobId === null) return console.warn("Received binary packet from downloader but it has nothing running");
	const job = jobs.get(jobId);
	if (!job) return console.warn("Received data packet for unknown job from downloader");
	const client = clients.get(job.session_id);
	if (!client) return console.warn("Found job but session is gone");
	ws.data.current_download = null;
	job.assigned_downloader = null;
	job.finished = true;

	function finishJob(job: DownloadJob, client: ServerWebSocket<ClientSocketData>, failureMessage?: string) {
		if (!failureMessage) {
			client.send(createClientboundPacket<JobDownloadFinishS2CPacket>("job-download-finish", { job_id: job.job_id }));
		} else {
			client.send(createClientboundPacket<JobDownloadFailS2CPacket>("job-download-fail", { job_id: job.job_id, reason: failureMessage }));
		}
		pushQueueIntoDownloaders();
		checkForAutoPackaging(client);
	}

	const { metadata } = job;

	const fileName = (metadata.track ? metadata.track + " - " : "") + (metadata.title || metadata.video_id);

	// There are multiple options:
	// album_subfolders = true (default)
	// - /<artist>/<album>/
	// (here, an empty album or artist will automatically be filtered out)
	//
	// album_subfolders = false
	// - artist is not set:
	// /<album>/
	// - album is not set:
	// /<artist>/
	// - both are set:
	// /<artist> - <album>/
	// - both are not set:
	// / (root)

	const artistName = metadata.artists.join(" & ");
	const albumName = metadata.album;

	// if subfolders are not used, the artist is integrated into the album folder name
	const artist = client.data.settings.useAlbumSubfolders && job.artist_folder ? artistName : undefined;
	const album =
		client.data.settings.useAlbumSubfolders && job.album_folder
			? albumName
			: artistName && albumName && job.album_folder && job.artist_folder
				? `${artistName} - ${albumName}`
				: // In such a case, only one of them can be present or one is or both are disabled
					job.artist_folder && artistName
					? artistName
					: job.album_folder && albumName
						? albumName
						: undefined;

	const outputPath = path.join(process.cwd(), "downloads", client.data.session_id, ...filterStrings(artist, album)).replace(/\\/g, "/");

	try {
		await mkdir(outputPath, { recursive: true });
		await writeFile(path.join(outputPath, ...filterStrings(fileName)) + ".mp3", new Uint8Array(data));
	} catch (error) {
		console.error(error);
		finishJob(job, client, "Could not write audio file");
		return;
	}

	finishJob(job, client);
};
