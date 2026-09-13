import prisma from "../src/lib/prisma";
import { Day } from "../src/generated/prisma";

const schoolIdArg = process.argv.find((arg) => arg.startsWith("--schoolId="));
const schoolId = schoolIdArg?.split("=")[1] || "default-school";

const activeDays: Day[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

const demoPlan = [
  {
    className: "Nursery",
    days: activeDays,
    lessons: [
      { period: "Period 1", subject: "Phonics", teacherSurname: "1" },
      { period: "Period 2", subject: "Spanish", teacherSurname: "1" },
      { period: "Period 3", subject: "Number Work", teacherSurname: "1" },
    ],
  },
  {
    className: "KG1",
    days: activeDays,
    lessons: [
      { period: "Period 1", subject: "Number Work", teacherSurname: "2" },
      { period: "Period 2", subject: "Creative Arts", teacherSurname: "2" },
      { period: "Period 3", subject: "Spanish", teacherSurname: "2" },
    ],
  },
  {
    className: "Class 1A",
    days: activeDays,
    lessons: [
      { period: "Period 1", subject: "English Language ", teacherSurname: "3" },
      { period: "Period 2", subject: "Mathematics", teacherSurname: "4" },
      { period: "Period 3", subject: "Integrated Science", teacherSurname: "5" },
    ],
  },
  {
    className: "KG2",
    days: activeDays,
    lessons: [{ period: "Period 4", subject: "Number Work", teacherSurname: "2" }],
  },
  {
    className: "Class 1B",
    days: activeDays,
    lessons: [{ period: "Period 4", subject: "English Language ", teacherSurname: "3" }],
  },
  {
    className: "Class 2A",
    days: activeDays,
    lessons: [{ period: "Period 5", subject: "Mathematics", teacherSurname: "4" }],
  },
  {
    className: "Class 2B",
    days: activeDays,
    lessons: [{ period: "Period 6", subject: "Mathematics", teacherSurname: "4" }],
  },
  {
    className: "Class 3A",
    days: activeDays,
    lessons: [{ period: "Period 5", subject: "Integrated Science", teacherSurname: "5" }],
  },
  {
    className: "Class 3B",
    days: activeDays,
    lessons: [{ period: "Period 6", subject: "Integrated Science", teacherSurname: "5" }],
  },
  {
    className: "Class 4A",
    days: activeDays,
    lessons: [{ period: "Period 7", subject: "Social Studies", teacherSurname: "6" }],
  },
  {
    className: "Class 4B",
    days: activeDays,
    lessons: [{ period: "Period 8", subject: "Integrated Science", teacherSurname: "6" }],
  },
  {
    className: "Class 5A",
    days: activeDays,
    lessons: [{ period: "Period 4", subject: "Religious & Moral Education", teacherSurname: "7" }],
  },
  {
    className: "Class 5B",
    days: activeDays,
    lessons: [{ period: "Period 5", subject: "Social Studies", teacherSurname: "7" }],
  },
  {
    className: "Class 6A",
    days: activeDays,
    lessons: [{ period: "Period 4", subject: "Ghanaian Language", teacherSurname: "8" }],
  },
  {
    className: "Class 6B",
    days: activeDays,
    lessons: [{ period: "Period 5", subject: "Religious & Moral Education", teacherSurname: "8" }],
  },
  {
    className: "JHS 1A",
    days: activeDays,
    lessons: [{ period: "Period 6", subject: "Core Mathematics", teacherSurname: "13" }],
  },
  {
    className: "JHS 1B",
    days: activeDays,
    lessons: [{ period: "Period 7", subject: "English", teacherSurname: "13" }],
  },
  {
    className: "JHS 2A",
    days: activeDays,
    lessons: [{ period: "Period 6", subject: "English", teacherSurname: "14" }],
  },
  {
    className: "JHS 2B",
    days: activeDays,
    lessons: [{ period: "Period 7", subject: "Integrated Science (JHS)", teacherSurname: "14" }],
  },
  {
    className: "JHS 3A",
    days: activeDays,
    lessons: [{ period: "Period 6", subject: "Integrated Science (JHS)", teacherSurname: "15" }],
  },
  {
    className: "JHS 3B",
    days: activeDays,
    lessons: [{ period: "Period 7", subject: "Social Studies (JHS)", teacherSurname: "15" }],
  },
];

async function getRequiredData() {
  const [classes, periods, subjects, teachers] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    }),
    prisma.schoolPeriodTemplate.findMany({
      where: { schoolId, isActive: true, type: "TEACHING" },
      select: { id: true, name: true, startTime: true, endTime: true },
    }),
    prisma.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
        subjects: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    classesByName: new Map(classes.map((item) => [item.name, item])),
    periodsByName: new Map(periods.map((item) => [item.name, item])),
    subjectsByName: new Map(subjects.map((item) => [item.name, item])),
    teachersBySurname: new Map(teachers.map((item) => [item.surname, item])),
  };
}

function toDateTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

async function main() {
  console.log(`Seeding valid demo timetable for ${schoolId}`);
  const { classesByName, periodsByName, subjectsByName, teachersBySurname } = await getRequiredData();

  const rows = [];
  for (const classPlan of demoPlan) {
    for (const day of classPlan.days) {
      const cls = classesByName.get(classPlan.className);
      if (!cls) throw new Error(`Class not found: ${classPlan.className}`);

      for (const lessonPlan of classPlan.lessons) {
        const period = periodsByName.get(lessonPlan.period);
        const subject = subjectsByName.get(lessonPlan.subject);
        const teacher = teachersBySurname.get(lessonPlan.teacherSurname);
        if (!period) throw new Error(`Period not found: ${lessonPlan.period}`);
        if (!subject) throw new Error(`Subject not found: ${lessonPlan.subject}`);
        if (!teacher) throw new Error(`Teacher not found: ${lessonPlan.teacherSurname}`);
        if (!teacher.subjects.some((item) => item.id === subject.id)) {
          throw new Error(`Teacher ${teacher.name} ${teacher.surname} is not assigned to ${subject.name}`);
        }

        rows.push({
          schoolId,
          name: `${subject.name.trim()} - ${cls.name}`,
          day,
          startTime: new Date(toDateTime(period.startTime)),
          endTime: new Date(toDateTime(period.endTime)),
          subjectId: subject.id,
          classId: cls.id,
          teacherId: teacher.id,
          periodTemplateId: period.id,
        });
      }
    }
  }

  await prisma.lesson.deleteMany({ where: { schoolId } });
  const result = await prisma.lesson.createMany({ data: rows });
  console.log(`Created ${result.count} valid timetable lessons.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
