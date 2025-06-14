
// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./styles.css";
import Navbarpage from "./navbar/page";
import SidebarMenu from "./components/Sidebar";
import LogoutButton from "./components/LogoutButton";
import { getUserRole } from "./serverActions/getUserRole";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default async function RootLayout({ children }) {
  const { success, roleid, username, rolename, error } = await getUserRole();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Navbarpage />
        {success ? (
          <div style={{ display: "flex" }}>
            <SidebarMenu roleid={roleid} />
            <div
              style={{
                marginLeft: "200px", // Match SidebarMenu width
                flexGrow: 1,
                paddingTop: "60px", // Match navbar height
                minHeight: "100vh",
                backgroundColor: "#f2f2f2",
              }}
            >
              <LogoutButton username={username} role={rolename} />
              {children}
            </div>
          </div>
        ) : (
          <div style={{ minHeight: "100vh", backgroundColor: "#f2f2f2" }}>
            {children}
          </div>
        )}
      </body>
    </html>
  );
}
