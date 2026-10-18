import type { Metadata } from "next";
import "@/crm/crm.css";

export const metadata: Metadata = {
  title: { default: "CRM", template: "%s · Auvetric CRM" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
};

// Applies the saved theme before first paint so light-theme users don't see a dark flash.
const themeBoot = `try{var t=localStorage.getItem("auv-crm-theme");if(t==="light"||t==="dark")document.documentElement.dataset.crmTheme=t}catch(e){}`;

export default function CrmRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="crm">
      <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      {children}
    </div>
  );
}
