import Navbar from "../components/jobsnavbar";

export default function joblayout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ marginTop: '30px' }}>{children}</main>
    </>
  );
}
