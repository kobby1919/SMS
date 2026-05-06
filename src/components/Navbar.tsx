import type { AppRole } from "@/src/lib/roles";
import NavbarClient from "./NavbarClient";

type Props = {
  role: AppRole;
};

const Navbar = ({ role }: Props) => {
  const userData = {
    fullName: "Mr. Jay",
    role,
  };

  return <NavbarClient user={userData} />;
};

export default Navbar;
