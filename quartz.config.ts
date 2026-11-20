import type { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const colors = {
  light: "#1B1C21", lightgray: "#2C2E35", gray: "#9A9EA8", darkgray: "#C3C6CC",
  dark: "#E6E7EA", secondary: "#6983FC", tertiary: "#6FA8E8",
  highlight: "#252845", textHighlight: "#3A2E18",
}
const config: QuartzConfig = {
  configuration: {
    pageTitle: "知识图谱",
    enableSPA: false,
    enablePopovers: false,
    analytics: null,
    locale: "zh-CN",
    ignorePatterns: [],
    defaultDateType: "created",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: { header: "sans-serif", body: "sans-serif", code: "monospace" },
      colors: { lightMode: colors, darkMode: colors },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.CrawlLinks({ markdownLinkResolution: "absolute" }),
      Plugin.Description(),
    ],
    filters: [],
    emitters: [Plugin.ContentIndex({ enableSiteMap: false, enableRSS: false })],
  },
}

export default config
