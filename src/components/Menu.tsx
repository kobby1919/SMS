import type { AppRole } from "@/src/lib/roles";
import MenuClient from "./MenuClient";

type Props = {
  role: AppRole;
};

const Menu = ({ role }: Props) => {
  return <MenuClient role={role} />;
};

export default Menu;
