import { redirect } from "next/navigation";

const TeacherClassOverviewRedirect = async ({
  params,
}: {
  params: Promise<{ classId: string }>;
}) => {
  const { classId } = await params;
  redirect(`/list/classes/${classId}/overview`);
};

export default TeacherClassOverviewRedirect;