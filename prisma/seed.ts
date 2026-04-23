import "dotenv/config";
import { Day, UserSex } from "../src/generated/prisma";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── CONFIG: put your real Clerk teacher ID here for testing ──────────────────
// This teacher will be assigned to classes so you can log in and see lessons
const REAL_TEACHER_CLERK_ID = "user_3CUBcewPnLl0KYUAVDewhXWEAxd"; // ← your real Clerk ID

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

// ─── Ghana period times (7:30am start, 40-min periods) ───────────────────────
const PERIODS: { start: [number, number]; end: [number, number] }[] = [
  { start: [7, 30],  end: [8, 10]  },  // Period 1
  { start: [8, 10],  end: [8, 50]  },  // Period 2
  { start: [8, 50],  end: [9, 30]  },  // Period 3
  { start: [9, 50],  end: [10, 30] },  // Period 4 (after break)
  { start: [10, 30], end: [11, 10] },  // Period 5
  { start: [11, 10], end: [11, 50] },  // Period 6
  { start: [12, 30], end: [13, 10] },  // Period 7 (after lunch)
  { start: [13, 10], end: [13, 50] },  // Period 8
];

const toDateTime = (hour: number, minute: number): Date => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

async function main() {
  console.log("🌱 Seeding Ghana school data...");

  // 1. Admins
  await prisma.admin.createMany({
    data: [
      { id: "admin1", username: "admin1" },
      { id: "admin2", username: "admin2" },
    ],
    skipDuplicates: true,
  });

  // 2. Grades
  for (const g of GHANA_GRADES) {
    await prisma.grade.upsert({
      where:  { level: g.level },
      update: { order: g.order },
      create: g,
    });
  }
  console.log("✅ Grades created");

  // 3. Classes
  const gradeRecords = await prisma.grade.findMany();
  const gradeMap = Object.fromEntries(gradeRecords.map((g) => [g.level, g.id]));
  for (const cls of CLASS_DEFINITIONS) {
    await prisma.class.upsert({
      where:  { name: cls.name },
      update: {},
      create: { name: cls.name, section: cls.section, capacity: cls.capacity, gradeId: gradeMap[cls.gradeLevel] },
    });
  }
  console.log("✅ Classes created");

  // 4. Subjects
  for (const name of SUBJECTS) {
    await prisma.subject.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log("✅ Subjects created");

  // 5. Teachers
  // teacher1 uses the REAL Clerk ID so you can log in and see their timetable
  const subjectRecords = await prisma.subject.findMany({ orderBy: { id: "asc" } });

  for (let i = 1; i <= 15; i++) {
    const subA = subjectRecords[(i - 1) % subjectRecords.length].id;
    const subB = subjectRecords[i % subjectRecords.length].id;

    // teacher1 gets the real Clerk ID — all others get seed IDs
    const teacherId = i === 1 ? REAL_TEACHER_CLERK_ID : `teacher${i}`;

    await prisma.teacher.upsert({
      where:  { username: `teacher${i}` },
      update: { id: teacherId }, // update ID in case seed was run before
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
        maxClasses: 5,
        subjects:   { connect: [{ id: subA }, { id: subB }] },
      },
    });
  }
  console.log("✅ Teachers created (teacher1 = your Clerk ID)");

  // 6. Lessons
  // ── Distribution strategy ────────────────────────────────────────────────
  // Each class gets 4 periods per day across 5 days = 20 lessons per class
  // Teacher assignment: each teacher gets roughly (classes / teachers) classes
  // We rotate teachers across classes so no teacher exceeds 5 unique classes
  // teacher1 (your real ID) is explicitly assigned to the first 5 classes
  const classRecords = await prisma.class.findMany({ orderBy: [{ grade: { order: "asc" } }, { name: "asc" }] });
  const teacherRecords = await prisma.teacher.findMany({ orderBy: { username: "asc" } });
  const days = Object.values(Day);

  // Map: classIndex → teacherId
  // First 5 classes → teacher1 (your real Clerk ID) so you can see a full schedule
  const getTeacherForClass = (classIndex: number): string => {
    if (classIndex < 5) return REAL_TEACHER_CLERK_ID;
    // Remaining classes distributed across teachers 2–15
    const teacherIndex = ((classIndex - 5) % (teacherRecords.length - 1)) + 1;
    return teacherRecords[teacherIndex]?.id ?? teacherRecords[0].id;
  };

  let lessonCount = 0;

  for (let ci = 0; ci < classRecords.length; ci++) {
    const cls        = classRecords[ci];
    const teacherId  = getTeacherForClass(ci);
    // Pick subjects for this class — cycle through all subjects
    const classSubjects = [
      subjectRecords[(ci * 2) % subjectRecords.length],
      subjectRecords[(ci * 2 + 1) % subjectRecords.length],
      subjectRecords[(ci * 2 + 2) % subjectRecords.length],
      subjectRecords[(ci * 2 + 3) % subjectRecords.length],
    ];

    for (const day of days) {
      for (let p = 0; p < 4; p++) {
        const subject = classSubjects[p % classSubjects.length];
        const period  = PERIODS[p];

        await prisma.lesson.create({
          data: {
            name:      `${subject.name} - ${cls.name}`,
            day:       day as Day,
            startTime: toDateTime(...period.start),
            endTime:   toDateTime(...period.end),
            subjectId: subject.id,
            classId:   cls.id,
            teacherId,
          },
        });
        lessonCount++;
      }
    }
  }
  console.log(`✅ ${lessonCount} lessons created`);
  console.log(`   → teacher1 (${REAL_TEACHER_CLERK_ID}) assigned to first 5 classes`);

  // 7. Parents
  for (let i = 1; i <= 25; i++) {
    await prisma.parent.upsert({
      where:  { username: `parent${i}` },
      update: {},
      create: {
        id: `parent${i}`, username: `parent${i}`,
        name: `Parent`, surname: `${i}`,
        email: `parent${i}@gmail.com`, phone: `020000000${i}`, address: `Accra, Ghana`,
      },
    });
  }
  console.log("✅ Parents created");

  // 8. Students — two per class
  const allClasses = await prisma.class.findMany({ include: { grade: true } });
  let studentIndex = 1;
  for (const cls of allClasses) {
    for (let s = 0; s < 2; s++) {
      const parentId = `parent${((studentIndex - 1) % 25) + 1}`;
      await prisma.student.upsert({
        where:  { username: `student${studentIndex}` },
        update: {},
        create: {
          id: `student${studentIndex}`, username: `student${studentIndex}`,
          name: `Student`, surname: `${studentIndex}`,
          email: `student${studentIndex}@school.edu.gh`,
          phone: `050000000${studentIndex}`, address: `Accra, Ghana`,
          bloodType: "B+", sex: studentIndex % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
          parentId, gradeId: cls.gradeId, classId: cls.id,
        },
      });
      studentIndex++;
    }
  }
  console.log(`✅ ${studentIndex - 1} students created`);

  // 9. Exams, assignments, results
  const lessons = await prisma.lesson.findMany({ take: 10 });
  for (let i = 0; i < lessons.length; i++) {
    const exam = await prisma.exam.create({
      data: {
        title: `Mid-Term Exam ${i + 1}`,
        startTime: new Date(),
        endTime: new Date(new Date().setHours(new Date().getHours() + 2)),
        lessonId: lessons[i].id,
      },
    });
    await prisma.assignment.create({
      data: {
        title: `Assignment ${i + 1}`, startDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        lessonId: lessons[i].id,
      },
    });
    await prisma.result.create({
      data: {
        score: Math.floor(Math.random() * 40) + 60,
        studentId: `student${i + 1}`, examId: exam.id,
      },
    });
  }
  console.log("✅ Exams, assignments & results created");
  console.log("\n🎉 Seeding completed successfully!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });