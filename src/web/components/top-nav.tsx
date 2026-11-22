import { Link, useLocation } from "react-router";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export const navItems = [{ to: "/features", label: "Features" }] as const;

/** An item is current on its own path and on any path below it (e.g. `/features/:id`). */
const isCurrent = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

export function TopNav() {
  const { pathname } = useLocation();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl p-2">
        <NavigationMenu aria-label="Main">
          <NavigationMenuList className="gap-1">
            {navItems.map((item) => (
              <NavigationMenuItem key={item.to}>
                <NavigationMenuLink
                  active={isCurrent(pathname, item.to)}
                  className={navigationMenuTriggerStyle()}
                  render={<Link to={item.to} />}
                >
                  {item.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}
