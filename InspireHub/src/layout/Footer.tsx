const Footer = () => {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 py-6">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} InspireHub. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
