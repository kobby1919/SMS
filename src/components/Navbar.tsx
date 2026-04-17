import { currentUser } from "@clerk/nextjs/server";
import NavbarClient from "./NavbarClient";


const Navbar = async () => {
  const user = await currentUser();
  
  // Prepare a clean user object to pass to the client
  const userData = {
    fullName: user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Mr. Jay",
    role: (user?.publicMetadata?.role as string) || "student",
  };

  return <NavbarClient user={userData} />;
};

export default Navbar;