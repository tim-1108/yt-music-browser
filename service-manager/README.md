# service-manager

A socket to manage downloads and the connection to clients and downloader services.

Allows for adding downloads, enqueues them and dispatches them to an available service.

Many different packets can be sent from Client -> Manager, Manager -> Downloader and all back and forth. These packets are JSON objects with this structure:

```json
{
	"id": "<packet-id>",
	"data": {
		// A record containing keys of primitives, arrays and other objects.
	}
}
```

A download job may have some typical metadata fields set:

-   title
-   album
-   artists (an array of artist names)
-   track (the track number on the album)

Downloads are always in the MPEG (.mp3) format.

Enviroment variables for the manager:

| Key                     | Description                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AUTH                    | A password required to force-restart all connected downloader services.                                                 |
| DOWNLOADER_CREATION_KEY | A password required when creating a socket as a downloader. This ensures only trusted downloader services may be added. |
