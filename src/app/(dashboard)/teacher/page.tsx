import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import BigCalendar from "@/src/components/BigCalendar";

const TeacherPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        <div className="h-full bg-white p-4 rounded-2xl shadow-sm">
          <h1 className="text-xl font-nunito font-extrabold text-gray-800 mb-2">
            My Schedule
          </h1>
          <BigCalendar />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <EventCalendar />
        <EventList dateParam={searchParams.date} />
        <Announcements />
      </div>
    </div>
  );
};

export default TeacherPage;
