import "dotenv/config";
import { Day, UserSex } from "../src/generated/prisma";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- ADMIN ---
  await prisma.admin.createMany({
    data: [
      { id: "admin1", username: "admin1" },
      { id: "admin2", username: "admin2" },
    ],
  });

  // --- GRADE ---
  for (let i = 1; i <= 6; i++) {
    await prisma.grade.create({ data: { level: i.toString() } });
  }

  // --- CLASS ---
  for (let i = 1; i <= 6; i++) {
    await prisma.class.create({
      data: {
        name: `${i}A`,
        gradeId: i,
        capacity: Math.floor(Math.random() * 5) + 15,
      },
    });
  }

  // --- SUBJECT ---
  const subjects = [
    "Mathematics", "Science", "English", "History", "Geography",
    "Physics", "Chemistry", "Biology", "Computer Science", "Art",
  ];
  for (const name of subjects) {
    await prisma.subject.create({ data: { name } });
  }

  // --- TEACHER ---
  for (let i = 1; i <= 15; i++) {
    await prisma.teacher.create({
      data: {
        id: `teacher${i}`,
        username: `teacher${i}`,
        name: `TName${i}`,
        surname: `TSurname${i}`,
        email: `teacher${i}@example.com`,
        phone: `123-456-789${i}`,
        address: `Address${i}`,
        bloodType: "A+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        subjects: { connect: [{ id: (i % 10) + 1 }] },
        classes: { connect: [{ id: (i % 6) + 1 }] },
      },
    });
  }

  // --- LESSON ---
  for (let i = 1; i <= 30; i++) {
    await prisma.lesson.create({
      data: {
        name: `Lesson${i}`,
        day: Object.values(Day)[
          Math.floor(Math.random() * Object.values(Day).length)
        ],
        startTime: new Date(new Date().setHours(10, 0, 0, 0)),
        endTime: new Date(new Date().setHours(12, 0, 0, 0)),
        subjectId: (i % 10) + 1,
        classId: (i % 6) + 1,
        teacherId: `teacher${(i % 15) + 1}`,
      },
    });
  }

  // --- PARENT ---
  for (let i = 1; i <= 25; i++) {
    await prisma.parent.create({
      data: {
        id: `parentId${i}`,
        username: `parentId${i}`,
        name: `PName ${i}`,
        surname: `PSurname ${i}`,
        email: `parent${i}@example.com`,
        phone: `123-456-789${i}`,
        address: `Address${i}`,
      },
    });
  }

  // --- STUDENT ---
  for (let i = 1; i <= 50; i++) {
    await prisma.student.create({
      data: {
        id: `student${i}`,
        username: `student${i}`,
        name: `SName${i}`,
        surname: `SSurname ${i}`,
        email: `student${i}@example.com`,
        phone: `987-654-321${i}`,
        address: `Address${i}`,
        bloodType: "O-",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        parentId: `parentId${Math.ceil(i / 2) % 25 || 25}`,
        gradeId: (i % 6) + 1,
        classId: (i % 6) + 1,
      },
    });
  }

  // --- EXAM, ASSIGNMENT & RESULT ---
  for (let i = 1; i <= 10; i++) {
    const exam = await prisma.exam.create({
      data: {
        title: `Exam ${i}`,
        startTime: new Date(),
        endTime: new Date(new Date().setHours(new Date().getHours() + 1)),
        lessonId: i,
      },
    });

    await prisma.assignment.create({
      data: {
        title: `Assignment ${i}`,
        startDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        lessonId: i,
      },
    });

    await prisma.result.create({
      data: {
        score: Math.floor(Math.random() * 100),
        studentId: `student${i}`,
        examId: exam.id,
      },
    });
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });