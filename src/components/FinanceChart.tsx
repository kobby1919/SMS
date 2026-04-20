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
import { motion } from "framer-motion";

type MonthData = { name: string; income: number; expense: number };

const FinanceChart = ({ data }: { data: MonthData[] }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl w-full h-full p-5 shadow-sm"
    >
      <div className="flex justify-between items-center mb-2">
        <h1 className="font-nunito font-extrabold text-lg text-gray-800">Finance Overview</h1>
        <Image src="/moreDark.png" alt="" width={18} height={18} />
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} tickLine={false} tickMargin={10} />
          <YAxis axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} tickLine={false} tickMargin={10} />
          <Tooltip contentStyle={{ borderRadius: "12px", borderColor: "#e5e7eb", fontSize: "12px" }} />
          <Legend align="center" verticalAlign="top" wrapperStyle={{ paddingBottom: "20px", fontSize: "12px" }} />
          <Line type="monotone" dataKey="income"  stroke="#C3EBFA" strokeWidth={4} dot={false} />
          <Line type="monotone" dataKey="expense" stroke="#CFCEFF" strokeWidth={4} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default FinanceChart;
