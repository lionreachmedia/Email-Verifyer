export default function Logo({ size = 'md' }) {
  const box = size === 'lg' ? 'w-9 h-9 rounded-xl' : 'w-8 h-8 rounded-lg';
  return (
    <>
      <div className={`${box} bg-gradient-to-br from-accent to-purple flex items-center justify-center`}>
        <svg className="w-4 h-4 fill-none stroke-white stroke-2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 8l9-6 9 6v10l-9 6-9-6V8z" /><path d="M12 2v20M3 8l9 4 9-4" />
        </svg>
      </div>
      <span className={`font-semibold ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>MailGuard</span>
    </>
  );
}
