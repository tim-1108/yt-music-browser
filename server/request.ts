import { API_BASE, CLASSIC_API_BASE, DEFAULT_REQUEST_CONTEXT, DEFAULT_REQUEST_HEADERS, DEFAULT_CLASSIC_YT_REQUEST_CONTEXT } from "./constants";
import { simplifyInnerTubeResponse } from "./types";

export async function makeInnerTubeRequest<T, U = undefined>(
	endpoint: string,
	body: Object,
	address?: string,
	continuation?: string,
	useClassicEndpoints?: boolean
): Promise<U extends undefined ? T : { contents: T; header?: U } | null>;

export async function makeInnerTubeRequest<T, U>(
	endpoint: string,
	body: Object,
	address?: string,
	continuation?: string,
	useClassicEndpoints: boolean = false
) {
	const continuationParams = continuation ? `?continuation=${continuation}` : "";
	const forwardedHeader: { [key: string]: string } = address ? { "X-Forwarded-For": address } : {};

	const headers = useClassicEndpoints ? DEFAULT_CLASSIC_YT_REQUEST_CONTEXT : DEFAULT_REQUEST_CONTEXT;

	const response = await fetch((useClassicEndpoints ? CLASSIC_API_BASE : API_BASE) + endpoint + continuationParams, {
		method: "POST",
		body: JSON.stringify({ ...body, ...headers }),
		headers: {
			...DEFAULT_REQUEST_HEADERS,
			...forwardedHeader
		}
	});
	try {
		const data = (await response.json()) as Response<T, U>;
		const hasHeader = "header" in data;
		const simplified = simplifyInnerTubeResponse(continuation ? data.continuationContents : data.contents, "contents") as T;
		const headerSimplified = hasHeader ? (simplifyInnerTubeResponse(data.header, "header") as U) : undefined;
		return data.error ? null : hasHeader ? { contents: simplified, header: headerSimplified } : simplified;
	} catch (error) {
		console.error(error);
		return null;
	}
}

interface Response<T, U> {
	error?: ResponseError;
	responseContext: ResponseContext;
	contents: T;
	continuationContents?: T;
	header?: U;
}

interface ResponseContext {
	visitorData?: string;
	serviceTrackingParams: {
		service: string;
		params: {
			key: string;
			value: string;
		}[];
	}[];
}

interface ResponseError {
	code: number;
	message: string;
	status: string;
	errors: {
		message: string;
		domain: string;
		reason: string;
	}[];
}
