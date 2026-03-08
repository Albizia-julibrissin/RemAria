import { ScrollToBottomButton } from "./scroll-to-bottom-button";

export default function ExplorationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ScrollToBottomButton />
    </>
  );
}
