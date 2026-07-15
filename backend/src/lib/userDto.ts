import { parseTabs, resolveUserTabs } from "./tabs";

export function toUserDTO(user: {
  id: string;
  name: string;
  phone: string;
  role: string;
  customRoleId: string | null;
  active: boolean;
  languageCode: string;
  themeId: string;
  fontScale: number;
  customBackground: string | null;
  customTextColor: string | null;
  customRole: { id: string; name: string; tabs: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    customRoleId: user.customRoleId,
    customRole: user.customRole
      ? { id: user.customRole.id, name: user.customRole.name, tabs: parseTabs(user.customRole.tabs) }
      : null,
    active: user.active,
    tabs: resolveUserTabs(user.role, user.customRole?.tabs),
    languageCode: user.languageCode,
    themeId: user.themeId,
    fontScale: user.fontScale,
    customBackground: user.customBackground,
    customTextColor: user.customTextColor,
  };
}
