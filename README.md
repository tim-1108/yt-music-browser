# yt-music-browser

A Nuxt app for searching and downloading songs, videos and albums from YouTube Music. Automatically includes metadata, album covers and stores the files in named folders.

Uses **yt-dlp** (https://github.com/yt-dlp/yt-dlp) to download the videos on the backend.

A user first downloads their videos to the server and then requests a bulk download to their client.

This bulk download comes in the form of a .zip file including all .mp3 files that were download sucessfully.

The .zip file also includes (if not disabled by the user) a folder structure as follows

```
<artist name>/<album name>/<track (if specified)><title>.mp3
```

![image](https://github.com/user-attachments/assets/09f96f16-1510-49e1-8c76-95bce3d3bbee)
![image](https://github.com/user-attachments/assets/73ebc985-aedd-44d8-9a74-ca874fa9137b)

Enviroment Variables for the Nuxt App

| Key          | Description                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------- |
| SOCKET_URL   | A ws(s) protocol URL to reach the manager socket                                                   |
| DOWNLOAD_URL | An http(s) protocol URL from where the final results can be downloaded (likely same as SOCKET_URL) |
