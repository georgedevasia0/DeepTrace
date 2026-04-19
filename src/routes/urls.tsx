import { URLsDefaultView } from './urls-defaultview';
import { URLsTreeView } from './urls-treeview';
import { useState } from 'react';

export function URLs() {
    const [selection, setSelection] = useState("default");

    return (
        <div className="w-full">
          {selection === "default"
            ? <URLsDefaultView selection={selection} setSelection={setSelection} />
            : <URLsTreeView selection={selection} setSelection={setSelection} />}
        </div>
    );
}
