import { currentUser } from "@clerk/nextjs/server";
import MenuClient from "./MenuClient";

const Menu = async () => {
  const user = await currentUser();
  const role = (user?.publicMetadata.role as string) ?? "student";

  return <MenuClient role={role} />;
};

export default Menu;
