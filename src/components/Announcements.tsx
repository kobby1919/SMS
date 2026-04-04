"use client";

import { motion } from "framer-motion";

const announcements = [
  {
    id: 1,
    title: "School Reopening Notice",
    date: "2026-01-01",
    description:
      "All students are expected to resume on the first Monday of the new term. Please come with all required materials.",
    bg: "bg-jaySkyLight border-l-4 border-jaySky",
  },
  {
    id: 2,
    title: "PTA Meeting Scheduled",
    date: "2026-01-08",
    description:
      "Parents and guardians are invited to the quarterly PTA meeting. Attendance is highly encouraged.",
    bg: "bg-jayPurpleLight border-l-4 border-jayPurple",
  },
  {
    id: 3,
    title: "End of Term Exams",
    date: "2026-01-15",
    description:
      "End of term examinations begin next week. Students should review all topics covered this term.",
    bg: "bg-jayYellowLight border-l-4 border-jayYellow",
  },
];

const Announcements = () => {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-nunito font-extrabold text-lg text-gray-800">
          Announcements
        </h1>
        <span className="text-xs text-jayPurple font-semibold cursor-pointer hover:underline">
          View All
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {announcements.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-xl p-4 ${a.bg}`}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-sm text-gray-700">{a.title}</h2>
              <span className="text-[10px] text-gray-400 bg-white rounded-full px-2 py-0.5">
                {a.date}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {a.description}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Announcements;