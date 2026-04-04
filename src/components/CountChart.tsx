"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const TOTAL = 2468;
const BOYS = 1357;
const GIRLS = 1111;
const BOYS_PCT = Math.round((BOYS / TOTAL) * 100);
const GIRLS_PCT = 100 - BOYS_PCT;

const CountChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl w-full h-full p-5 shadow-sm flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-nunito font-extrabold text-[15px] text-gray-800">
          Students
        </h1>
        <Image src="/moreDark.png" alt="" width={18} height={18} />
      </div>

      {/* Total */}
      <div className="text-center mb-5">
        <p className="font-nunito font-extrabold text-4xl text-gray-800 leading-none">
          {TOTAL.toLocaleString()}
        </p>
        <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-1">
          Enrolled
        </p>
      </div>

      {/* Split bar */}
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex mb-4">
        <div
          className="bg-jaySky rounded-full"
          style={{ width: `${BOYS_PCT}%` }}
        />
        <div className="bg-jayYellow rounded-full flex-1" />
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-2 mt-auto">
        <div className="bg-[#F7F8FA] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-jaySky" />
            <span className="text-[11px] text-gray-400">Boys</span>
          </div>
          <p className="font-nunito font-extrabold text-xl text-gray-800 leading-tight">
            {BOYS.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400">{BOYS_PCT}% of total</p>
        </div>
        <div className="bg-[#F7F8FA] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-jayYellow" />
            <span className="text-[11px] text-gray-400">Girls</span>
          </div>
          <p className="font-nunito font-extrabold text-xl text-gray-800 leading-tight">
            {GIRLS.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400">{GIRLS_PCT}% of total</p>
        </div>
      </div>
    </motion.div>
  );
};

export default CountChart;
