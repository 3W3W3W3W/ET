import DoubleSpace from "./DoubleSpace";

export const portableTextComponents = {
  block: DoubleSpace.block,
  marks: {
    link: ({ value, children }) => {
      const href = value?.href || "";
      const isExternal = /^https?:\/\//i.test(href);
      return (
        <a
          href={href}
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          className="no-underline transition-colors duration-150 ease-in-out hover:text-[var(--color-highlight)]"
        >
          {children}
        </a>
      );
    },
  },
};
