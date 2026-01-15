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

    local targets = to_list(project.targets())
    local target = targets[1]

    print(target:targetfile())
end
