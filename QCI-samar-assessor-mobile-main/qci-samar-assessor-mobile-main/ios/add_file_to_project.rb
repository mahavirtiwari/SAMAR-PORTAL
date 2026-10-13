require 'xcodeproj'

project_path = 'assessor.xcodeproj'
file_path = 'assessor/GoogleService-Info.plist'

project = Xcodeproj::Project.open(project_path)
group = project.main_group.find_sub_group('assessor')
file_ref = group.files.find { |file| file.path == 'GoogleService-Info.plist' }

if file_ref
  puts "File already exists in project."
else
  file_ref = group.new_reference('GoogleService-Info.plist')
  puts "Added file to project."
end

main_target = project.targets.find { |target| target.name == 'assessor' }
if main_target
  unless main_target.resources_build_phase.files_references.include?(file_ref)
    main_target.resources_build_phase.add_file_reference(file_ref)
    puts "Added file to target resources."
  else
    puts "File already in target resources."
  end
end

project.save
