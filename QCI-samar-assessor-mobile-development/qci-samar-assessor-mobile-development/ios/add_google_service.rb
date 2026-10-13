require 'xcodeproj'

project_path = 'assessor.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the group 'assessor'
group = project.main_group['assessor']
if group.nil?
  puts "Error: Could not find group 'assessor'"
  exit 1
end

# Check if file exists in group
file_name = 'GoogleService-Info.plist'
file_ref = group.files.find { |file| file.path == file_name }

if file_ref
  puts "Reference to #{file_name} found in project."
else
  puts "Adding #{file_name} to project..."
  # 'GoogleService-Info.plist' is passed, assuming it is inside the folder backed by the group
  file_ref = group.new_reference(file_name)
end

# Add to main target
target_name = 'assessor' 
target = project.targets.find { |t| t.name == target_name }

if target
  # Add to "Copy Bundle Resources" phase
  resources_phase = target.resources_build_phase
  if resources_phase.files_references.include?(file_ref)
     puts "#{file_name} is already in 'Copy Bundle Resources' build phase."
  else
     puts "Adding #{file_name} to 'Copy Bundle Resources' build phase."
     resources_phase.add_file_reference(file_ref)
     project.save
     puts "Project saved."
  end
else
  puts "Error: Could not find target '#{target_name}'"
end
