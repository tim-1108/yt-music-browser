# service-downloader

The actual downloader implemented using yt-dlp.

Connects to the manager and receives a new job when the previous one has finished.

Enviroment Variables

| Key         | Description                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| MANAGER_URL | The ws(s) protocol URL to connect to                                                                                             |
| COOKIES     | A base64 encoded Netscape cookie file, generated easily using yt-dlp (Ensures video downloading can happen w/o many rate limits) |
| CONTACT_URL | The identifier for the downloader. Does not have to be an actual URL, can be anything.                                           |
