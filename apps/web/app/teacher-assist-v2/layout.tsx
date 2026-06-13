import { TeacherAssistV2Provider } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import { TeacherAssistV2Shell } from "@/components/teacher-assist-v2/teacher-assist-v2-shell";

export default function TeacherAssistV2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TeacherAssistV2Provider>
      <TeacherAssistV2Shell>{children}</TeacherAssistV2Shell>
    </TeacherAssistV2Provider>
  );
}
