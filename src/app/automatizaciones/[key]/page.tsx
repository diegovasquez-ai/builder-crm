import { FlowEditorLoader } from "@/components/automations/FlowEditorLoader";

export default async function EditarAutomatizacionPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <FlowEditorLoader ruleKey={key} />;
}
