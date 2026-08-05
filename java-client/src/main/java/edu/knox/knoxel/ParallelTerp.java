package edu.knox.knoxel;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.function.Consumer;

public class ParallelTerp {

    private String programName;
    private String description;

    public ParallelTerp(String programName, String description) {
        if (programName == null || description == null) {
            throw new IllegalArgumentException("programName and description cannot be null!");
        }
        this.programName = programName;
        this.description = description;
    }

    // each element of the list is the instructions for a thread
    private List<AbstractTerp> threads = new LinkedList<>();

    public void addThread(Consumer<AbstractTerp> c) {
        AbstractTerp t = new AbstractTerp(new ArrayList<>()) {};
        threads.add(t);
        c.accept(t);
    }

    public List<List<TerpInstruction>> getAllThreads() {
        return threads.stream()
            .map(AbstractTerp::getInstructions)
            .toList();
    }

    public String getProgramName() {
        return programName;
    }

    public String getDescription() {
        return description;
    }

    public String toJson() {
        return KnoxelUploader.toJson(this, "fakeuser@domain.com");
    }
}
