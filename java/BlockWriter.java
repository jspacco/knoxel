

import java.io.File;
import java.io.IOException;
import java.io.PrintStream;

public class BlockWriter
{
    static final String TAB = "    ";
    
    public static String toJson(BlockType[][][] grid){
        /*
         {
             "length" : 2,
             "width"  : 3,
             "height" : 4,
             "blocks" : [
                 [
                     ["STONE","STONE","STONE","STONE"],
                     ["DIRT","DIRT","DIRT","DIRT"],
                     ["GRASS","GRASS","GRASS","GRASS"]
                 ],
                 [
                     ["AIR","AIR","AIR","AIR"],
                     ["BEDROCK","BEDROCK","BEDROCK","BEDROCK"],
                     ["GLASS","GLASS","GLASS","GLASS"]
                 ]
             ]
         }
         */
        StringBuffer buf = new StringBuffer();
        buf.append("{\n");
        buf.append(TAB+"\"width\" : "+grid.length+",\n");
        buf.append(TAB+"\"length\" : "+grid[0].length+",\n");
        buf.append(TAB+"\"height\" : "+grid[0][0].length+",\n");
        buf.append(TAB+"\"blocks\" : [\n");
        for (int x=0; x<grid.length; x++){
            buf.append(TAB+TAB+"[\n");
            for (int z=0; z<grid[x].length; z++){
                buf.append(TAB+TAB+TAB+"[");
                for (int y=0; y<grid[x][z].length; y++){
                    if (grid[x][z][y] == null){
                        //System.out.println("AIR");
                        buf.append("\"AIR\",");
                    } else {
                        String block = grid[x][z][y].toString();
                        buf.append("\""+block+"\",");
                    }
                }
                buf.replace(buf.length()-1,buf.length(),"");
                buf.append("],\n");
            }
            buf.replace(buf.length()-2,buf.length(),"\n");
            buf.append(TAB+TAB+"],\n");
        }
        buf.replace(buf.length()-2,buf.length(),"\n");
        buf.append(TAB+"]\n");
        buf.append("}");
        return buf.toString();
    }

    public static void writeDrawingToFile(BlockType[][][] grid, String filename)
    {
        try {
            String json = toJson(grid);
            PrintStream out = new PrintStream(new File(filename));
            out.println(json);
            out.flush();
            out.close();
        } catch (IOException e){
            throw new RuntimeException(e);
        }
    }

}
