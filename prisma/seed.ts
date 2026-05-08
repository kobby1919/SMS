import "dotenv/config";
import { Day, UserSex } from "../src/generated/prisma";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const REAL_ADMIN_CLERK_ID       = "user_3CSIHKzHwmvmvh88RvOuRJeN6lC";
const REAL_TEACHER_CLERK_ID     = "user_3CUBcewPnLl0KYUAVDewhXWEAxd";
const MAX_CLASSES_PER_TEACHER   = 5;
const LESSONS_PER_CLASS_PER_DAY = 4;
const DEFAULT_SCHOOL_ID         = "default-school";

// ─── Ghana school structure ───────────────────────────────────────────────────
const GHANA_GRADES = [
  { level: "Nursery", order: 1  },
  { level: "KG1",     order: 2  },
  { level: "KG2",     order: 3  },
  { level: "Class 1", order: 4  },
  { level: "Class 2", order: 5  },
  { level: "Class 3", order: 6  },
  { level: "Class 4", order: 7  },
  { level: "Class 5", order: 8  },
  { level: "Class 6", order: 9  },
  { level: "JHS 1",   order: 10 },
  { level: "JHS 2",   order: 11 },
  { level: "JHS 3",   order: 12 },
];

const CLASS_DEFINITIONS: {
  name: string; gradeLevel: string; section: string | null; capacity: number;
}[] = [
  { name: "Nursery", gradeLevel: "Nursery", section: null, capacity: 20 },
  { name: "KG1",     gradeLevel: "KG1",     section: null, capacity: 25 },
  { name: "KG2",     gradeLevel: "KG2",     section: null, capacity: 25 },
  ...["Class 1","Class 2","Class 3","Class 4","Class 5","Class 6"].flatMap((g) => [
    { name: `${g}A`, gradeLevel: g, section: "A", capacity: 35 },
    { name: `${g}B`, gradeLevel: g, section: "B", capacity: 35 },
  ]),
  ...["JHS 1","JHS 2","JHS 3"].flatMap((g) => [
    { name: `${g}A`, gradeLevel: g, section: "A", capacity: 40 },
    { name: `${g}B`, gradeLevel: g, section: "B", capacity: 40 },
  ]),
];

const SUBJECTS = [
  "Phonics", "Number Work", "Creative Arts",
  "English Language", "Mathematics", "Integrated Science",
  "Social Studies", "Religious & Moral Education", "Ghanaian Language",
  "Creative Arts & Design", "Computing / ICT", "Physical Education",
  "Core Mathematics", "English", "Integrated Science (JHS)",
  "Social Studies (JHS)", "RME (JHS)", "ICT (JHS)",
  "French", "Career Technology", "Ghanaian Language (JHS)",
];

const PERIODS: { start: [number, number]; end: [number, number] }[] = [
  { start: [7,  30], end: [8,  10] },
  { start: [8,  10], end: [8,  50] },
  { start: [8,  50], end: [9,  30] },
  { start: [9,  50], end: [10, 30] },
];

const toDateTime = (hour: number, minute: number): Date => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

async function main() {
  console.log("🌱 Seeding Ghana school data...");

  // ── School ────────────────────────────────────────────────────────────────
  await prisma.school.upsert({
    where:  { id: DEFAULT_SCHOOL_ID },
    update: {},
    create: {
      id:   DEFAULT_SCHOOL_ID,
      name: "Default School",
      slug: DEFAULT_SCHOOL_ID,
    },
  });
  console.log("✅ School created");

  // ── 1. Admins ─────────────────────────────────────────────────────────────
  await prisma.admin.upsert({
    where:  { id: REAL_ADMIN_CLERK_ID },
    update: { username: "admin1", schoolId: DEFAULT_SCHOOL_ID },
    create: {
      id:       REAL_ADMIN_CLERK_ID,
      username: "admin1",
      schoolId: DEFAULT_SCHOOL_ID,
    },
  });
  await prisma.admin.upsert({
    where:  { id: "admin2" },
    update: { username: "admin2", schoolId: DEFAULT_SCHOOL_ID },
    create: {
      id:       "admin2",
      username: "admin2",
      schoolId: DEFAULT_SCHOOL_ID,
    },
  });
  console.log("✅ Admins created (admin1 = your Clerk ID)");

  // ── 2. Grades ─────────────────────────────────────────────────────────────
  for (const g of GHANA_GRADES) {
    await prisma.grade.upsert({
      where:  { schoolId_level: { schoolId: DEFAULT_SCHOOL_ID, level: g.level } },
      update: { order: g.order },
      create: { ...g, schoolId: DEFAULT_SCHOOL_ID },
    });
  }
  console.log("✅ Grades created");

  // ── 3. Classes ────────────────────────────────────────────────────────────
  const gradeRecords = await prisma.grade.findMany();
  const gradeMap     = Object.fromEntries(gradeRecords.map((g) => [g.level, g.id]));
  for (const cls of CLASS_DEFINITIONS) {
    await prisma.class.upsert({
      where:  { schoolId_name: { schoolId: DEFAULT_SCHOOL_ID, name: cls.name } },
      update: {},
      create: {
        schoolId: DEFAULT_SCHOOL_ID,
        name:     cls.name,
        section:  cls.section,
        capacity: cls.capacity,
        gradeId:  gradeMap[cls.gradeLevel],
      },
    });
  }
  console.log("✅ Classes created");

  // ── 4. Subjects ───────────────────────────────────────────────────────────
  for (const name of SUBJECTS) {
    await prisma.subject.upsert({
      where:  { schoolId_name: { schoolId: DEFAULT_SCHOOL_ID, name } },
      update: {},
      create: { schoolId: DEFAULT_SCHOOL_ID, name },
    });
  }
  console.log("✅ Subjects created");

  // ── 5. Teachers ───────────────────────────────────────────────────────────
  const subjectRecords = await prisma.subject.findMany({ orderBy: { id: "asc" } });

  for (let i = 1; i <= 15; i++) {
    const subA      = subjectRecords[(i - 1) % subjectRecords.length].id;
    const subB      = subjectRecords[i       % subjectRecords.length].id;
    const teacherId = i === 1 ? REAL_TEACHER_CLERK_ID : `teacher${i}`;

    await prisma.teacher.upsert({
      where:  { username: `teacher${i}` },
      update: { id: teacherId },
      create: {
        id:         teacherId,
        username:   `teacher${i}`,
        name:       `Teacher`,
        surname:    `${i}`,
        email:      `teacher${i}@school.edu.gh`,
        phone:      `024000000${i}`,
        address:    `Accra, Ghana`,
        bloodType:  "O+",
        sex:        i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        schoolId:   DEFAULT_SCHOOL_ID,
        maxClasses: MAX_CLASSES_PER_TEACHER,
        subjects:   { connect: [{ id: subA }, { id: subB }] },
      },
    });
  }
  console.log("✅ Teachers created (teacher1 = your Clerk ID)");

  // ── 6. Lessons ────────────────────────────────────────────────────────────
  const classRecords   = await prisma.class.findMany({
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });
  const teacherRecords = await prisma.teacher.findMany({ orderBy: { username: "asc" } });
  const days           = Object.values(Day);

  const teacherClassMap = new Map<string, Set<number>>();
  for (const t of teacherRecords) {
    teacherClassMap.set(t.id, new Set());
  }

  const pickTeacher = (
    classId: number,
    usedInThisClass: Set<string>,
    preferred?: string,
  ): string | null => {
    const candidates = preferred
      ? [{ id: preferred }, ...teacherRecords.filter((t) => t.id !== preferred)]
      : teacherRecords;

    for (const t of candidates) {
      const classSet       = teacherClassMap.get(t.id)!;
      const alreadyInClass = classSet.has(classId);
      const underLimit     = alreadyInClass || classSet.size < MAX_CLASSES_PER_TEACHER;
      if (!usedInThisClass.has(t.id) && underLimit) return t.id;
    }
    return null;
  };

  let lessonCount = 0;

  for (let ci = 0; ci < classRecords.length; ci++) {
    const cls             = classRecords[ci];
    const usedInThisClass = new Set<string>();
    const roster: { teacherId: string; subjectId: number }[] = [];

    for (let p = 0; p < LESSONS_PER_CLASS_PER_DAY; p++) {
      const preferred = (p === 0 && ci < MAX_CLASSES_PER_TEACHER)
        ? REAL_TEACHER_CLERK_ID
        : undefined;

      const teacherId = pickTeacher(cls.id, usedInThisClass, preferred);
      if (!teacherId) {
        console.warn(`⚠️  No teacher available for ${cls.name} P${p + 1} — skipping`);
        continue;
      }

      usedInThisClass.add(teacherId);
      teacherClassMap.get(teacherId)!.add(cls.id);

      const subject = subjectRecords[
        (ci * LESSONS_PER_CLASS_PER_DAY + p) % subjectRecords.length
      ];
      roster.push({ teacherId, subjectId: subject.id });
    }

    for (const day of days) {
      for (let p = 0; p < roster.length; p++) {
        const { teacherId, subjectId } = roster[p];
        const subject = subjectRecords.find((s) => s.id === subjectId)!;
        const period  = PERIODS[p];

        await prisma.lesson.create({
          data: {
            schoolId:  DEFAULT_SCHOOL_ID,
            name:      `${subject.name} - ${cls.name}`,
            day:       day as Day,
            startTime: toDateTime(...period.start),
            endTime:   toDateTime(...period.end),
            subjectId,
            classId:   cls.id,
            teacherId,
          },
        });
        lessonCount++;
      }
    }
  }

  const teacher1Classes = teacherClassMap.get(REAL_TEACHER_CLERK_ID)?.size ?? 0;
  console.log(`✅ ${lessonCount} lessons created`);
  console.log(`   → teacher1 assigned to ${teacher1Classes} classes`);

  // ── 7. Parents ────────────────────────────────────────────────────────────
  for (let i = 1; i <= 25; i++) {
    await prisma.parent.upsert({
      where:  { username: `parent${i}` },
      update: {},
      create: {
        id:       `parent${i}`,
        username: `parent${i}`,
        name:     `Parent`,
        surname:  `${i}`,
        email:    `parent${i}@gmail.com`,
        phone:    `020000000${i}`,
        address:  `Accra, Ghana`,
        schoolId: DEFAULT_SCHOOL_ID,
      },
    });
  }
  console.log("✅ Parents created");

  // ── 8. Students ───────────────────────────────────────────────────────────
  const allClasses = await prisma.class.findMany({ include: { grade: true } });
  let studentIndex = 1;
  for (const cls of allClasses) {
    for (let s = 0; s < 2; s++) {
      const parentId = `parent${((studentIndex - 1) % 25) + 1}`;
      await prisma.student.upsert({
        where:  { username: `student${studentIndex}` },
        update: {},
        create: {
          id:        `student${studentIndex}`,
          username:  `student${studentIndex}`,
          name:      `Student`,
          surname:   `${studentIndex}`,
          email:     `student${studentIndex}@school.edu.gh`,
          phone:     `050000000${studentIndex}`,
          address:   `Accra, Ghana`,
          bloodType: "B+",
          sex:       studentIndex % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
          schoolId:  DEFAULT_SCHOOL_ID,
          parentId,
          gradeId:   cls.gradeId,
          classId:   cls.id,
        },
      });
      studentIndex++;
    }
  }
  console.log(`✅ ${studentIndex - 1} students created`);

  // ── 9. Exams, assignments, results ────────────────────────────────────────
  const lessons = await prisma.lesson.findMany({ take: 10 });
  for (let i = 0; i < lessons.length; i++) {
    const exam = await prisma.exam.create({
      data: {
        schoolId:  DEFAULT_SCHOOL_ID,
        title:     `Mid-Term Exam ${i + 1}`,
        startTime: new Date(),
        endTime:   new Date(new Date().setHours(new Date().getHours() + 2)),
        lessonId:  lessons[i].id,
      },
    });
    await prisma.assignment.create({
      data: {
        schoolId:  DEFAULT_SCHOOL_ID,
        title:     `Assignment ${i + 1}`,
        startDate: new Date(),
        dueDate:   new Date(new Date().setDate(new Date().getDate() + 7)),
        lessonId:  lessons[i].id,
      },
    });
    await prisma.result.create({
      data: {
        schoolId:  DEFAULT_SCHOOL_ID,
        score:     Math.floor(Math.random() * 40) + 60,
        studentId: `student${i + 1}`,
        examId:    exam.id,
      },
    });
  }
  console.log("✅ Exams, assignments & results created");
  console.log("\n🎉 Seeding completed successfully!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });