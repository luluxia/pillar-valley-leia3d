import { ScrollViewStyleReset } from "expo-router/html";
import React from "react";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head style={{ backgroundColor: "#F09458" }}>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1.00001,viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="幻柱峡谷 3D" />
        <meta name="theme-color" content="#F09458" />
      </head>
      <script
        dangerouslySetInnerHTML={{
          __html: `// use full screen on iOS PWAs
      if (window.navigator.standalone === true) {
        const html = document.getElementsByTagName("html")[0];
        html.setAttribute("style", "height: 100vh;");
      }

      `,
        }}
      />

      <body>{children}</body>
    </html>
  );
}
