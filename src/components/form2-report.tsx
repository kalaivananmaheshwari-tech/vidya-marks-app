"use client";

import React from "react";

export type Form2Data = {
  district: string;
  reportTitle: string;
  formName: string;
  schoolName: string;
  udiseNo: string;
  classDisplay: string;
  examDisplay: string;
  overviewTable: {
    nominalRoll: { male: number; female: number; total: number };
    absent: { male: number | string; female: number | string; total: number | string };
    appeared: { male: number; female: number; total: number };
    passed: { male: number; female: number; total: number };
    passPercentage: { male: number; female: number; total: number };
    failed: { male: number; female: number; total: number };
    prevExamPassPct: number;
    currExamPassPct: number;
    schoolAverageMark: { prevExam: number; currExam: number };
  };
  breakdownTable: {
    mediumWiseFailed: { tamilMedium: number; englishMedium: number; total: number };
    noOfStudentsFailed: {
      singleSubject: number | string;
      twoSubject: number | string;
      threeSubject: number | string;
      fourSubject: number | string;
      fiveSubject: number | string;
      allSubject: number | string;
    };
    schoolFirstMark: {
      scienceStream: number | string;
      artsStream: number | string;
      vocationalStream: number | string;
    };
  };
  subjectWiseFails: {
    tamil: number | string;
    english: number | string;
    maths: number | string;
    physics: number | string;
    chemistry: number | string;
    biology: number | string;
    botany: number | string;
    zoology: number | string;
    computerSci: number | string;
    computerApp: number | string;
    empSkill: number | string;
    history: number | string;
    economics: number | string;
    commerce: number | string;
    accountancy: number | string;
    allOtherSub: number | string;
  };
  teachersPerformance: Array<{
    sNo: number;
    teacherName: string;
    subjectName: string;
    appeared: number;
    passed: number;
    failed: number | string;
    passPercentage: string;
    centum: number | string;
    failOnlyThisSubject: number | string;
    averageMark: number;
    lowestMark: number;
    highestMark: number;
    prevExamPass: string;
    currExamPass: string;
  }>;
  paddedTeacherRows: Array<{ sNo: number }>;
};

export default function Form2ReportView({ data }: { data: Form2Data }) {
  const {
    district,
    reportTitle,
    formName,
    schoolName,
    udiseNo,
    overviewTable,
    breakdownTable,
    subjectWiseFails,
    teachersPerformance,
    paddedTeacherRows,
  } = data;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 text-black">
      {/* Top Header matching Form - II */}
      <div className="border-b border-black pb-2.5">
        <div className="flex flex-wrap items-center justify-between text-xs font-bold uppercase tracking-wide">
          <span>{district}</span>
          <span className="text-center text-sm font-extrabold">{reportTitle}</span>
          <span className="text-rose-700 font-extrabold tracking-wider">{formName}</span>
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold border border-black p-2 bg-slate-50/50 print:bg-transparent">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">Name of the School :</span>
            <span className="uppercase text-black font-extrabold">{schoolName}</span>
          </div>
          <div className="flex items-center sm:justify-end gap-2">
            <span className="text-slate-600 font-semibold">Udise No :</span>
            <span className="font-mono text-black font-extrabold">{udiseNo}</span>
          </div>
        </div>
      </div>

      {/* TABLE 1: Main Performance Breakdown */}
      <div className="overflow-x-auto mt-3">
        <table className="official-table w-full text-[11px] text-black border-collapse border border-black text-center">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th colSpan={3} className="border border-black px-1.5 py-1.5">
                No.of Students as per Nominal Roll /Attendance
              </th>
              <th colSpan={3} className="border border-black px-1.5 py-1.5">
                Absent
              </th>
              <th colSpan={3} className="border border-black px-1.5 py-1.5">
                No.of Students Appeared
              </th>
              <th colSpan={3} className="border border-black px-1.5 py-1.5">
                No.of Students Passed
              </th>
              <th colSpan={3} className="border border-black px-1.5 py-1.5">
                Pass %
              </th>
              <th colSpan={3} className="border border-black px-1.5 py-1.5">
                No.of Students Failed
              </th>
              <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-16">
                PREVIOUS EXAM Pass %
              </th>
              <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-16">
                CURRENT EXAM Pass %
              </th>
              <th colSpan={2} className="border border-black px-1.5 py-1.5">
                School Average Mark (All Subjects)
              </th>
            </tr>
            <tr className="bg-slate-50 font-bold border-b border-black text-[10px]">
              <th className="border border-black px-1 py-1">Male</th>
              <th className="border border-black px-1 py-1">Female</th>
              <th className="border border-black px-1 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1 py-1">Male</th>
              <th className="border border-black px-1 py-1">Female</th>
              <th className="border border-black px-1 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1 py-1">Male</th>
              <th className="border border-black px-1 py-1">Female</th>
              <th className="border border-black px-1 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1 py-1">Male</th>
              <th className="border border-black px-1 py-1">Female</th>
              <th className="border border-black px-1 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1 py-1">Male</th>
              <th className="border border-black px-1 py-1">Female</th>
              <th className="border border-black px-1 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1 py-1">Male</th>
              <th className="border border-black px-1 py-1">Female</th>
              <th className="border border-black px-1 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1 py-1 text-[9px]">PREV EXAM</th>
              <th className="border border-black px-1 py-1 text-[9px]">CURR EXAM</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold tabular-nums text-xs">
              {/* Nominal */}
              <td className="border border-black py-1.5">{overviewTable.nominalRoll.male}</td>
              <td className="border border-black py-1.5">{overviewTable.nominalRoll.female}</td>
              <td className="border border-black py-1.5 bg-slate-50">{overviewTable.nominalRoll.total}</td>

              {/* Absent */}
              <td className="border border-black py-1.5">{overviewTable.absent.male}</td>
              <td className="border border-black py-1.5">{overviewTable.absent.female}</td>
              <td className="border border-black py-1.5 bg-slate-50">{overviewTable.absent.total}</td>

              {/* Appeared */}
              <td className="border border-black py-1.5">{overviewTable.appeared.male}</td>
              <td className="border border-black py-1.5">{overviewTable.appeared.female}</td>
              <td className="border border-black py-1.5 bg-slate-50">{overviewTable.appeared.total}</td>

              {/* Passed */}
              <td className="border border-black py-1.5 text-emerald-800">{overviewTable.passed.male}</td>
              <td className="border border-black py-1.5 text-emerald-800">{overviewTable.passed.female}</td>
              <td className="border border-black py-1.5 text-emerald-800 bg-slate-50">{overviewTable.passed.total}</td>

              {/* Pass % */}
              <td className="border border-black py-1.5">{overviewTable.passPercentage.male}</td>
              <td className="border border-black py-1.5">{overviewTable.passPercentage.female}</td>
              <td className="border border-black py-1.5 bg-slate-50 font-extrabold">{overviewTable.passPercentage.total}</td>

              {/* Failed */}
              <td className="border border-black py-1.5 text-rose-800">{overviewTable.failed.male}</td>
              <td className="border border-black py-1.5 text-rose-800">{overviewTable.failed.female}</td>
              <td className="border border-black py-1.5 text-rose-800 bg-slate-50">{overviewTable.failed.total}</td>

              {/* Public Exam Pass % comparisons */}
              <td className="border border-black py-1.5">{overviewTable.prevExamPassPct}%</td>
              <td className="border border-black py-1.5 font-extrabold">{overviewTable.currExamPassPct}%</td>

              {/* School Average Mark */}
              <td className="border border-black py-1.5">{overviewTable.schoolAverageMark.prevExam}</td>
              <td className="border border-black py-1.5 font-extrabold">{overviewTable.schoolAverageMark.currExam}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE 2: Medium wise Failed & Number of Failed Subjects & Stream First Mark */}
      <div className="overflow-x-auto mt-2.5">
        <table className="official-table w-full text-[11px] text-black border-collapse border border-black text-center">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th colSpan={3} className="border border-black px-2 py-1.5">
                Medium wise Failed Students
              </th>
              <th colSpan={6} className="border border-black px-2 py-1.5">
                No.of Students Failed
              </th>
              <th colSpan={3} className="border border-black px-2 py-1.5">
                School First Mark
              </th>
            </tr>
            <tr className="bg-slate-50 font-bold border-b border-black text-[10px]">
              <th className="border border-black px-1.5 py-1">Tamil Medium</th>
              <th className="border border-black px-1.5 py-1">English Medium</th>
              <th className="border border-black px-1.5 py-1 bg-slate-200/50">Total</th>

              <th className="border border-black px-1.5 py-1">Single Subject</th>
              <th className="border border-black px-1.5 py-1">Two Subject</th>
              <th className="border border-black px-1.5 py-1">Three Subject</th>
              <th className="border border-black px-1.5 py-1">Four Subject</th>
              <th className="border border-black px-1.5 py-1">Five Subject</th>
              <th className="border border-black px-1.5 py-1 bg-slate-200/50">All Subject</th>

              <th className="border border-black px-1.5 py-1">Science Stream</th>
              <th className="border border-black px-1.5 py-1">Arts Stream</th>
              <th className="border border-black px-1.5 py-1">Vocational Stream</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold tabular-nums text-xs">
              <td className="border border-black py-1.5">{breakdownTable.mediumWiseFailed.tamilMedium}</td>
              <td className="border border-black py-1.5">{breakdownTable.mediumWiseFailed.englishMedium}</td>
              <td className="border border-black py-1.5 bg-slate-50 text-rose-800">{breakdownTable.mediumWiseFailed.total}</td>

              <td className="border border-black py-1.5">{breakdownTable.noOfStudentsFailed.singleSubject}</td>
              <td className="border border-black py-1.5">{breakdownTable.noOfStudentsFailed.twoSubject}</td>
              <td className="border border-black py-1.5">{breakdownTable.noOfStudentsFailed.threeSubject}</td>
              <td className="border border-black py-1.5">{breakdownTable.noOfStudentsFailed.fourSubject}</td>
              <td className="border border-black py-1.5">{breakdownTable.noOfStudentsFailed.fiveSubject}</td>
              <td className="border border-black py-1.5 bg-slate-50">{breakdownTable.noOfStudentsFailed.allSubject}</td>

              <td className="border border-black py-1.5 font-extrabold text-brand-900">{breakdownTable.schoolFirstMark.scienceStream}</td>
              <td className="border border-black py-1.5 font-extrabold text-brand-900">{breakdownTable.schoolFirstMark.artsStream}</td>
              <td className="border border-black py-1.5 font-extrabold text-brand-900">{breakdownTable.schoolFirstMark.vocationalStream}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE 3: SUBJECT WISE FAILED STUDENTS */}
      <div className="overflow-x-auto mt-2.5">
        <table className="official-table w-full text-[11px] text-black border-collapse border border-black text-center">
          <thead>
            <tr className="bg-slate-200 font-bold border-b border-black">
              <th colSpan={16} className="py-1 tracking-wider uppercase text-[10.5px]">
                SUBJECT WISE FAILED STUDENTS
              </th>
            </tr>
            <tr className="bg-slate-50 font-bold border-b border-black text-[9.5px]">
              <th className="border border-black px-1 py-1">Tamil</th>
              <th className="border border-black px-1 py-1">English</th>
              <th className="border border-black px-1 py-1">Maths</th>
              <th className="border border-black px-1 py-1">Physics</th>
              <th className="border border-black px-1 py-1">Chemistry</th>
              <th className="border border-black px-1 py-1">Biology</th>
              <th className="border border-black px-1 py-1">Botany</th>
              <th className="border border-black px-1 py-1">Zoology</th>
              <th className="border border-black px-1 py-1">COMPUTER Sci.</th>
              <th className="border border-black px-1 py-1">COMPUTER App.</th>
              <th className="border border-black px-1 py-1">Emp. Skill</th>
              <th className="border border-black px-1 py-1">History</th>
              <th className="border border-black px-1 py-1">Economics</th>
              <th className="border border-black px-1 py-1">Commerce</th>
              <th className="border border-black px-1 py-1">Accountancy</th>
              <th className="border border-black px-1 py-1">All other Sub.</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold tabular-nums text-xs">
              <td className="border border-black py-1.5">{subjectWiseFails.tamil}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.english}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.maths}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.physics}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.chemistry}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.biology}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.botany}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.zoology}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.computerSci}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.computerApp}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.empSkill}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.history}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.economics}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.commerce}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.accountancy}</td>
              <td className="border border-black py-1.5">{subjectWiseFails.allOtherSub}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE 4: TEACHERS PERFORMANCE (Up to 20 Rows) */}
      <div className="overflow-x-auto mt-3">
        <table className="official-table w-full text-[10.5px] text-black border-collapse border border-black text-center">
          <thead>
            <tr className="bg-slate-200 font-bold border-b border-black">
              <th colSpan={13} className="py-1 tracking-wider uppercase text-xs">
                TEACHERS PERFORMANCE
              </th>
            </tr>
            <tr className="bg-slate-100 font-bold border-b border-black text-center">
              <th rowSpan={2} className="border border-black px-1 py-1 w-8">
                S. No
              </th>
              <th rowSpan={2} className="border border-black px-2 py-1 text-left min-w-[140px]">
                Name of the Teacher
              </th>
              <th rowSpan={2} className="border border-black px-2 py-1 text-left min-w-[110px]">
                Subject
              </th>
              <th colSpan={3} className="border border-black px-1.5 py-1">
                No.of Students
              </th>
              <th rowSpan={2} className="border border-black px-1.5 py-1 w-14">
                Pass %
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 w-12 text-[9.5px]">
                No.of Centum
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 w-16 text-[9.5px]">
                Fail only this subject
              </th>
              <th rowSpan={2} className="border border-black px-1.5 py-1 w-14">
                Average Mark
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 w-12">
                Lowest Mark
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 w-12">
                Highest Mark
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 w-12 text-[9.5px]">
                PREV EXAM Pass %
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 w-12 text-[9.5px]">
                CURR EXAM Pass %
              </th>
            </tr>
            <tr className="bg-slate-50 font-bold border-b border-black text-[9.5px]">
              <th className="border border-black px-1 py-1">Appeared</th>
              <th className="border border-black px-1 py-1">Passed</th>
              <th className="border border-black px-1 py-1">Failed</th>
            </tr>
          </thead>
          <tbody>
            {teachersPerformance.map((tp) => (
              <tr key={tp.sNo} className="border-b border-black hover:bg-slate-50 font-semibold">
                <td className="border border-black py-1 tabular-nums">{tp.sNo}</td>
                <td className="border border-black px-2 py-1 text-left font-bold uppercase whitespace-nowrap">
                  {tp.teacherName}
                </td>
                <td className="border border-black px-2 py-1 text-left uppercase whitespace-nowrap font-bold">
                  {tp.subjectName}
                </td>
                <td className="border border-black py-1 tabular-nums">{tp.appeared}</td>
                <td className="border border-black py-1 tabular-nums text-emerald-800">{tp.passed}</td>
                <td className="border border-black py-1 tabular-nums text-rose-800">{tp.failed}</td>
                <td className="border border-black py-1 tabular-nums font-bold">{tp.passPercentage}</td>
                <td className="border border-black py-1 tabular-nums">{tp.centum}</td>
                <td className="border border-black py-1 tabular-nums font-bold text-rose-700">
                  {tp.failOnlyThisSubject}
                </td>
                <td className="border border-black py-1 tabular-nums font-bold">{tp.averageMark}</td>
                <td className="border border-black py-1 tabular-nums">{tp.lowestMark}</td>
                <td className="border border-black py-1 tabular-nums font-bold text-emerald-800">{tp.highestMark}</td>
                <td className="border border-black py-1 tabular-nums text-[10px]">{tp.prevExamPass}</td>
                <td className="border border-black py-1 tabular-nums text-[10px] font-bold">{tp.currExamPass}</td>
              </tr>
            ))}

            {/* Empty Spacer rows up to 20 matching official Attachment 1 */}
            {paddedTeacherRows.map((pr) => (
              <tr key={`padded-teacher-${pr.sNo}`} className="border-b border-black h-6">
                <td className="border border-black py-1 tabular-nums text-[10px] text-slate-400">{pr.sNo}</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
                <td className="border border-black">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Official Signatures Footer */}
      <div className="flex justify-between items-center pt-14 mt-6 px-8 text-xs font-bold text-black uppercase">
        <span>Class teacher sign</span>
        <span>HM/Principal sign</span>
      </div>
    </div>
  );
}
