"use client";

import Image from "next/image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Rectangle,
  Legend,
} from "recharts";

const barData = [
  { name: "Mon", present: 90, absent: 50 },
  { name: "Tue", present: 60, absent: 50 },
  { name: "Wed", present: 70, absent: 45 },
  { name: "Thur", present: 40, absent: 50 },
  { name: "Fri", present: 80, absent: 30 },
];

const AttendanceChart = () => {
  return (
    <div className="bg-white rounded-lg p-4 h-full">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Attendance</h1>
        <Image src="/moreDark.png" alt="" width={20} height={20} />
      </div>
      <div className="w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd"/>
            <XAxis dataKey="name" axisLine={false} tick={{fill: "#d1d5db"}} tickLine={false}/>
            <YAxis  axisLine={false} tick={{fill: "#d1d5db"}} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:"10px", borderColor:"lightgray"}}/>
            <Legend
              align="left"
              verticalAlign="top"
              wrapperStyle={{ paddingTop: "20px", paddingBottom: "40px" }}
            />
            <Bar
              dataKey="present"
              fill="#FAE27C"
              legendType="circle"
              radius={[10, 10, 0, 0]}
            />
            <Bar
              dataKey="absent"
              fill="#C3EBFA"
              legendType="circle"
              radius={[10, 10, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AttendanceChart;
