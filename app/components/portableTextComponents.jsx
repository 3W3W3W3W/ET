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
          className="no-underline transition-colors duration-[1600ms] ease-out hover:text-[var(--color-highlight)]"
        >
          {children}
        </a>
      );
    },
  },
};
