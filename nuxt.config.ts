// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-04-03",
	devtools: { enabled: false },
	modules: ["@nuxtjs/tailwindcss", "@nuxt/image"],
	css: ["@fortawesome/fontawesome-svg-core/styles.css", "assets/main.css"],
	build: {
		transpile: [
			"@fortawesome/fontawesome-svg-core",
			"@fortawesome/free-brands-svg-icons",
			"@fortawesome/free-regular-svg-icons",
			"@fortawesome/free-solid-svg-icons",
			"@fortawesome/vue-fontawesome"
		]
	},
	runtimeConfig: {
		public: {
			socketURL: process.env.SOCKET_URL,
			downloadURL: process.env.DOWNLOAD_URL,
			settingsVersion: 4
		}
	},
	ssr: false,
	app: {
		head: {
			htmlAttrs: {
				lang: "en"
			},
			title: "YouTube Music Browser",
			link: [
				{ rel: "manifest", href: "/manifest.json" },
				{ rel: "apple-touch-icon", href: "/icon.png" },
				{ rel: "apple-touch-startup-image", href: "/icon.png" }
			],
			meta: [
				{ name: "apple-mobile-web-app-capable", content: "yes" },
				{ name: "apple-mobile-web-app-status-bar-style", content: "black" },
				{ name: "apple-mobile-web-app-title", content: "YouTube Music Downloader" },
				{ name: "mobile-web-app-capable", content: "yes" },
				{ name: "viewport", content: "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" }
			]
		}
	}
});
