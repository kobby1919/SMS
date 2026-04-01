"use client";

import Image from "next/image";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
const lineData = [
  { name: "Jan", income: 4000, expense: 2500 },
  { name: "Feb", income: 3500, expense: 3000 },
  { name: "Mar", income: 9000, expense: 2000 },
  { name: "Apr", income: 6000, expense: 4000 },
  { name: "May", income: 5000, expense: 3500 },
  { name: "Jun", income: 5677, expense: 3200 },
  { name: "Jul", income: 3800, expense: 3000 },
  { name: "Aug", income: 3211, expense: 2800 },
  { name: "Sep", income: 3444, expense: 3100 },
  { name: "Oct", income: 1111, expense: 2500 },
  { name: "Nov", income: 3456, expense: 3300 },
  { name: "Dec", income: 9000, expense: 4000 },
];

const FinanceChart = () => {
  return (
    <div className="bg-white rounded-xl w-full h-full p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Finance</h1>
        <Image src="/moreDark.png" alt="" width={20} height={20} />
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          width={500}
          height={300}
          data={lineData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tick={{ fill: "#d1d5db" }}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#d1d5db" }}
            tickLine={false}
            tickMargin={20}
          />
          <Tooltip />
          <Legend
            align="center"
            verticalAlign="top"
            wrapperStyle={{ paddingTop: "10px", paddingBottom: "30px" }}
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#C3EBFA"
            strokeWidth={5}
          />
          <Line type="monotone" dataKey="expense" stroke="#CFCEFF" strokeWidth={5}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FinanceChart;
