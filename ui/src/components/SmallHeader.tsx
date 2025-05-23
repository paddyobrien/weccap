import React from "react";

export default function SmallHeader({children}: React.PropsWithChildren) {
    return (
        <span style={{fontWeight: 500, fontSize: 13}}>{children}</span>
    )
}