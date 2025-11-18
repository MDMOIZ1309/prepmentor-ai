import { MainRoutes } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

interface NavigationRoutesProps {
  isMobile?: boolean;
}

export const NavigationRoutes = ({ isMobile = false }: NavigationRoutesProps) => {
  return (
    <ul
      className={cn(
        "flex items-center gap-6",
        isMobile && "items-start flex-col gap-8"
      )}
    >
      {MainRoutes.map((route) => (
        <li key={route.href}>
          {route.href.startsWith("#") ? (
            <a
              href={route.href}
              className="text-base text-neutral-600 hover:text-neutral-900"
            >
              {route.label}
            </a>
          ) : (
            <NavLink
              to={route.href}
              className={({ isActive }) =>
                cn(
                  "text-base text-neutral-600",
                  isActive && "text-neutral-900 font-semibold"
                )
              }
            >
              {route.label}
            </NavLink>
          )}
        </li>
      ))}
    </ul>
  );
};
