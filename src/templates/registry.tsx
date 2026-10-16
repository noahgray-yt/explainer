import type { ComponentType } from "react";
import type { Slide, TemplateName } from "../../shared/schema";
import type { Theme } from "../theme/themes";
import { BarsSlide } from "./BarsSlide";
import { BeforeAfterSlide } from "./BeforeAfterSlide";
import { CardsGridSlide } from "./CardsGridSlide";
import { ChecklistSlide } from "./ChecklistSlide";
import { CompareSlide } from "./CompareSlide";
import { FlowSlide } from "./FlowSlide";
import { HubSlide } from "./HubSlide";
import { PromptListSlide } from "./PromptListSlide";
import { StatSlide } from "./StatSlide";
import { TitleSlide } from "./TitleSlide";
import type { TemplateProps } from "./types";

/** One template = one React component. */
export const TEMPLATE_COMPONENTS: { [K in TemplateName]: ComponentType<TemplateProps<K>> } = {
  title: TitleSlide,
  flow: FlowSlide,
  bars: BarsSlide,
  "cards-grid": CardsGridSlide,
  "before-after": BeforeAfterSlide,
  compare: CompareSlide,
  checklist: ChecklistSlide,
  "prompt-list": PromptListSlide,
  stat: StatSlide,
  hub: HubSlide,
};

export function SlideContent(props: { slide: Slide; theme: Theme; index: number; total: number }) {
  const Component = TEMPLATE_COMPONENTS[props.slide.template] as ComponentType<TemplateProps>;
  return <Component {...props} />;
}
