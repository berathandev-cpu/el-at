import { ImageResponse } from "next/og";
import { createElement } from "react";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (size !== "192" && size !== "512") return new Response(null, { status: 404 });

  const width = Number(size);
  const icon = createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundImage: "linear-gradient(145deg, #efe8dd, #76abae 78%)",
      },
    },
    createElement("svg", {
      width: width * .66, height: width * .66, viewBox: "0 0 24 24",
      fill: "none", stroke: "#303841", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
    }, createElement("path", { d: "M3 11l9-7 9 7M5.5 10v10h13V10" }),
    createElement("path", { d: "M9 14l2 2 4-4", stroke: "#9f3012" })),
  );

  return new ImageResponse(icon, { width, height: width });
}
