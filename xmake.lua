----------------------------------------------------------------------------------------------------
--
----------------------------------------------------------------------------------------------------

set_config('builddir', '.dist/build')
set_installdir('.dist/package')



----------------------------------------------------------------------------------------------------
--
----------------------------------------------------------------------------------------------------

add_rules('mode.debug', 'mode.release')
add_rules('plugin.compile_commands.autoupdate', {outputdir = '.vscode'})

set_languages('cxx23')

set_config('mode', 'debug')



----------------------------------------------------------------------------------------------------
--
----------------------------------------------------------------------------------------------------

set_project('everything')

function common()
    set_kind('binary')
    add_files('src/**.c')
    
    add_defines('UNICODE')
    add_defines('_ES_DEBUG')
    
    add_syslinks('user32', 'shell32')
    -- add_syslinks('unicows')
end

target('es', function ()
    common()
end)

target('es-original', function ()
    common()
    add_defines('_ES_ORIGINAL_BEHAVIOR')
end)
