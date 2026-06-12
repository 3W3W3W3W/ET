import React from "react";

const DoubleSpace = {
  block: ({ children }) => {
    if (children.length === 1 && children[0] === "") {
      return <br />;
    }
    return <p>{children}</p>;
  },
};

export default DoubleSpace;
