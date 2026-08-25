package edu.knox.knoxel;

import java.awt.Desktop;
import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.List;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

/**
 * Client uploader.
 * 
 * Create an HTTP client and send a POST request to the server
 * with the program delivered as a JSON payload.
 * 
 * Basically, the Terp client generates a series of instructions
 * that are serialized into JSON and uploaded. The server
 * never runs the student code.
 */
public class KnoxelUploader
{
    public static final int VERSION = 2;
    @SuppressWarnings("unused")
    private static final Gson GSON;

    private static String workerUrl = "https://knoxel-worker.jspacco.workers.dev";
    private static String pageUrl = "https://jspacco.github.io/knoxel";
    static {
        // NOTE: we could refactor everything out of the static initializer
        // to chain together the calls, but I think this code is clearer
        //
        // custom serializers so that enums serialize correctly
        // TURN_LEFT becomes turnleft
        // SUGAR_CANE becomes minecraft:sugar_cane
        GsonBuilder gsonBuilder = new GsonBuilder();
        gsonBuilder.registerTypeAdapter(TerpCommand.class, new JsonSerializer<TerpCommand>() {
            @Override
            public JsonElement serialize(TerpCommand src, Type typeOfSrc, JsonSerializationContext context) {
               return new JsonPrimitive(src.getId());
            }
        });
        gsonBuilder.registerTypeAdapter(TerpBlockType.class, new JsonSerializer<TerpBlockType>() {
            @Override
            public JsonElement serialize(TerpBlockType src, Type typeOfSrc, JsonSerializationContext context) {
                return new JsonPrimitive(src.getId());
            }
        });
        GSON = gsonBuilder.create();
    }

    // builds the JSON payload from a single-thread Terp
    public static String toJson(Terp terp, String email) {
        KnoxelPayload payload = new KnoxelPayload();
        payload.version = VERSION;
        payload.email = email;
        payload.program = terp.getProgramName();
        payload.description = terp.getDescription();
        // convert List<TerpInstruction> to List<List<TerpInstruction>>
        payload.threads = List.of(terp.getInstructions());
        return new Gson().toJson(payload);
    }
    
    // builds the JSON payload from a ParallelTerp
    public static String toJson(ParallelTerp terp, String email) {
        KnoxelPayload payload = new KnoxelPayload();
        payload.version = VERSION;
        payload.email = email;
        payload.program = terp.getProgramName();
        payload.description = terp.getDescription();
        payload.threads = terp.getAllThreads();
        return new Gson().toJson(payload);
    }

    public static void upload(String serverUrl, 
        Terp terp,
        String email, 
        String password)
    {
        String jsonPayload = toJson(terp, email);

        upload(serverUrl, 
            jsonPayload, 
            email, 
            password);
    }

    public static void upload(String serverUrl, 
        ParallelTerp terp,
        String email, 
        String password)
    {
        String jsonPayload = toJson(terp, email);

        upload(serverUrl, 
            jsonPayload, 
            email, 
            password);
    }

    private static void upload(String serverUrl, 
        String json,
        String email, 
        String password)
    {
        if (email.equals("")) {
            throw new RuntimeException("Your email cannot be empty");
        }
        if (!email.contains("@")) {
            throw new RuntimeException("Please use your full email address");
        }

        HttpClient client = HttpClient.newHttpClient();
        //System.out.println(json);
        // Send the POST request to the server
        // Handle the response and any errors
        // sending username and password as custom headers
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(serverUrl + "/upload"))
            .header("Content-Type", "application/json")
            .header("X-Email", email)
            .header("X-Password", password)
            .header("X-Version", Integer.toString(VERSION))
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                System.out.println("Upload Successful");
            } else {
                System.out.println("Upload failed " +response.body());
            }
        } catch (Exception e) {
            System.out.println("Upload failed with exception! " +e.toString());
        }
    }

    @SuppressWarnings("unused")
    private static class KnoxelPayload 
    {
        int version;
        String email;
        String program;
        String description;
        List<List<TerpInstruction>> threads;
    }

    public static void openInBrowser(Terp terp, String email)
    throws Exception
    {
        
        openInBrowser(terp, email, workerUrl, pageUrl);
    }

    public static void openInBrowser(Terp terp, String email, String workerUrl, String pageUrl)
    throws Exception
    {
        String json = toJson(terp, email);
        openInBrowser(json, workerUrl, pageUrl);
    }

    public static void openInBrowser(ParallelTerp terp, String email)
    throws Exception 
    {
        String json = toJson(terp, email);
        openInBrowser(json, workerUrl, pageUrl);
    }

    public static void openInBrowser(ParallelTerp terp, String email, String workerUrl, String pageUrl)
    throws Exception 
    {
        String json = toJson(terp, email);
        openInBrowser(json, workerUrl, pageUrl);
    }

    private static void openInBrowser(String json, String workerUrl, String pageUrl)
    throws Exception 
    {

        // 2. POST to Cloudflare Worker
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(workerUrl))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
        
        // 3. Parse the ID from {"id": "abc12345"}
        String body = response.body();
        // simple parse — no need for full JSON library just for one field
        String id = body.replaceAll(".*\"id\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        
        System.out.println("id = " + id);

        // 4. Open browser
        String url = pageUrl + "?id=" + id;
        Desktop.getDesktop().browse(URI.create(url));
    }

}

