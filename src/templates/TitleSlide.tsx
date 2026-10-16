import { Scene, useLayout } from "./Scene";
import type { TemplateProps } from "./types";

export function TitleSlide(props: TemplateProps<"title">) {
  const layout = useLayout(
    props,
    ({ text }, slide) => {
      text({
        key: "title",
        text: slide.title,
        path: ["title"],
        x: 160,
        y: 170,
        w: 1280,
        h: 300,
        size: 124,
        min: 56,
        align: "center",
        valign: "bottom",
        weight: "title",
        role: "title",
        multiline: true,
        lineHeight: 1.08,
        sparkle: true,
        partialUnderline: true,
      });
      text({
        key: "subtitle",
        text: slide.data.subtitle,
        path: ["data", "subtitle"],
        x: 200,
        y: 512,
        w: 1200,
        h: 70,
        size: 38,
        min: 22,
        align: "center",
        color: "ink-soft",
        multiline: true,
      });
      text({
        key: "takeaway",
        text: slide.takeaway,
        path: ["takeaway"],
        x: 260,
        y: 770,
        w: 1080,
        h: 60,
        size: 28,
        min: 18,
        align: "center",
        color: "ink-soft",
        multiline: true,
      });
    },
    { frame: false },
  );
  return <Scene layout={layout} props={props} />;
}
