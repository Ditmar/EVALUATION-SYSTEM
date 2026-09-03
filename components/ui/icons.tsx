import type { SVGProps } from "react";

/**
 * Small hand-authored line-icon set (24x24, stroke-based, currentColor) so
 * the admin sidebar doesn't need an icon library dependency for ~6 glyphs.
 */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function ExamIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 3.75h6a1 1 0 0 1 1 1V5h.75A2.25 2.25 0 0 1 19 7.25v11.5A2.25 2.25 0 0 1 16.75 21H7.25A2.25 2.25 0 0 1 5 18.75V7.25A2.25 2.25 0 0 1 7.25 5H8v-.25a1 1 0 0 1 1-1Z" />
      <path d="M9 12.5l2 2 4-4.5" />
    </Icon>
  );
}

export function LabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9.5 3h5" />
      <path d="M10.5 3v6.2c0 .35-.1.7-.3 1L5.9 16.6c-.9 1.4.1 3.2 1.8 3.2h8.6c1.7 0 2.7-1.8 1.8-3.2l-4.3-6.4a1.9 1.9 0 0 1-.3-1V3" />
      <path d="M8 15h8" />
    </Icon>
  );
}

export function SubjectIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5v-14Z" />
      <path d="M8 3v16" />
    </Icon>
  );
}

export function StudentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5" />
      <circle cx="17" cy="8.5" r="2.25" />
      <path d="M15.8 12.2c1.9.4 3.3 1.9 3.7 4.3" />
    </Icon>
  );
}

export function AssistantIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20c.6-3.6 3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M9 8.5 11 10.5 15.5 6" />
    </Icon>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15 17.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5h7.5A1.5 1.5 0 0 1 15 5v1.5" />
      <path d="M9.5 12h10" />
      <path d="M16.5 8.5 20 12l-3.5 3.5" />
    </Icon>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </Icon>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
    </Icon>
  );
}
