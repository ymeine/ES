------------------------------------------------------------------------------------------------ std

import('core.project.project')
import('core.project.config')



----------------------------------------------------------------------------------------------------
-- 
----------------------------------------------------------------------------------------------------

function to_list(input)
    local output = {}
    for key, value in pairs(input) do
        table.insert(output, value)
    end
    return output
end



----------------------------------------------------------------------------------------------------
-- 
----------------------------------------------------------------------------------------------------

function main()
    config.load()

    -- local target = project.target('es')

    -- XXX 2026-01-19T04:02:15+01:00@Europe/Paris
    -- Real logic from xmake — not exposed — to pick targets to run automatically can be seen in: 
    -- https://github.com/xmake-io/xmake/blob/766a7a86a7af89c58038500985c9d8ec441de25f/xmake/actions/run/main.lua#L229-L237
    local targets = to_list(project.targets())
    local target = targets[1]

    print(target:targetfile())
end
