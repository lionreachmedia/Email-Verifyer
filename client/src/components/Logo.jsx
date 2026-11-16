// Product mark: an envelope with a check. On dark grounds the mark is lime.
export default function Logo({ size = 'md', tone = 'dark' }) {
  const box = size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg';
  const text = tone === 'dark' ? 'text-white' : 'text-ink';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${box} bg-lime flex items-center justify-center`}>
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#111A16" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
          <path d="m3 7 9 6 9-6" />
          <path d="m15 19 2 2 4-4" />
        </svg>
      </span>
      <span className={`font-semibold tracking-tight ${text} ${size === 'lg' ? 'text-lg' : 'text-[15px]'}`}>MailGuard</span>
    </span>
  );
}
