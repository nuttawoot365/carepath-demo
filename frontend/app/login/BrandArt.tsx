import styles from './login.module.css';

/** ภาพประกอบหัวหน้าเข้าสู่ระบบ — ตกแต่งล้วน จึงซ่อนจากโปรแกรมอ่านหน้าจอ */
export function BrandArt() {
  return (
    <svg className={styles.art} viewBox="0 0 600 330" fill="none" aria-hidden="true">
      {/* พื้นและผนังทางเดิน */}
      <path d="M0 296 Q300 262 600 296 L600 330 L0 330 Z" fill="#fff" fillOpacity=".07" />
      <rect x="392" y="140" width="132" height="158" rx="10" fill="#fff" fillOpacity=".07" />
      <rect x="412" y="164" width="92" height="60" rx="6" fill="#fff" fillOpacity=".06" />

      {/* หมุดปลายทางพร้อมเครื่องหมายถูก */}
      <g className="pop pop--3">
        <path
          d="M458 26c24 0 43 19 43 43 0 30-43 66-43 66s-43-36-43-66c0-24 19-43 43-43Z"
          fill="#fff"
          fillOpacity=".22"
        />
        <circle cx="458" cy="69" r="26" fill="#fff" fillOpacity=".34" />
        <path
          d="m446 69 9 10 17-20"
          stroke="#fff"
          strokeOpacity=".92"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* ประกายแสดงความยินดี */}
      <g fill="#fff" fillOpacity=".28" className="pop">
        <circle cx="352" cy="58" r="6" />
        <circle cx="386" cy="106" r="4" />
        <circle cx="528" cy="60" r="5" />
        <circle cx="548" cy="118" r="4" />
        <rect x="330" y="96" width="12" height="5" rx="2.5" transform="rotate(-24 330 96)" />
        <rect x="546" y="86" width="12" height="5" rx="2.5" transform="rotate(28 546 86)" />
      </g>

      {/* ญาติที่เดินมาด้วย ยกมือดีใจ */}
      <g className="pop pop--2">
        <path d="M300 198v62" stroke="#fff" strokeOpacity=".42" strokeWidth="30" strokeLinecap="round" />
        <path
          d="M292 258 279 292M310 258l13 34"
          stroke="#fff"
          strokeOpacity=".38"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path d="M316 206q26-16 30-44" stroke="#fff" strokeOpacity=".46" strokeWidth="12" strokeLinecap="round" />
        <circle cx="300" cy="166" r="20" fill="#fff" fillOpacity=".55" />
      </g>

      {/* ผู้ป่วยบนรถเข็น ยกมือขึ้นเมื่อถึงที่หมาย */}
      <g className="pop">
        <circle cx="196" cy="256" r="44" stroke="#fff" strokeOpacity=".34" strokeWidth="7" />
        <circle cx="196" cy="256" r="7" fill="#fff" fillOpacity=".34" />
        <path
          d="M196 212v88M152 256h88M165 225l62 62M227 225l-62 62"
          stroke="#fff"
          strokeOpacity=".18"
          strokeWidth="4"
        />
        <circle cx="256" cy="282" r="15" stroke="#fff" strokeOpacity=".3" strokeWidth="6" />
        <path d="M180 196v56" stroke="#fff" strokeOpacity=".32" strokeWidth="8" strokeLinecap="round" />
        <path d="M196 250h56" stroke="#fff" strokeOpacity=".34" strokeWidth="9" strokeLinecap="round" />
        <rect x="186" y="192" width="36" height="60" rx="17" fill="#fff" fillOpacity=".5" />
        <path d="M222 206q26-12 32-42" stroke="#fff" strokeOpacity=".5" strokeWidth="12" strokeLinecap="round" />
        <circle cx="204" cy="172" r="19" fill="#fff" fillOpacity=".62" />
      </g>
    </svg>
  );
}
